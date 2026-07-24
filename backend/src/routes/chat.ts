import { Router, Response } from 'express';
import prisma from '../db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { buildUserContext } from '../services/contextBuilder';
import { streamChatCompletion } from '../services/chatService';

const router = Router();

// Basic in-memory rate limiting map: userId -> timestamps array
const userRateLimits = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const timestamps = userRateLimits.get(userId) || [];
  // Keep timestamps within last 60 seconds
  const validTimestamps = timestamps.filter(t => now - t < 60000);
  
  if (validTimestamps.length >= 20) {
    return false; // Exceeded limit (20 requests per minute)
  }
  
  validTimestamps.push(now);
  userRateLimits.set(userId, validTimestamps);
  return true;
}

// 1. POST /api/chat - Streamed Chat Endpoint
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { message, conversationId } = req.body;
  const userId = req.user!.id;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ message: 'Message content is required.' });
  }

  // Rate Limiting Check
  if (!checkRateLimit(userId)) {
    return res.status(429).json({ message: 'Rate limit exceeded. Please wait a minute before sending another message.' });
  }

  try {
    // 1. Find or create ChatConversation
    let conversation;
    if (conversationId) {
      conversation = await prisma.chatConversation.findFirst({
        where: { id: conversationId, userId }
      });
    }

    if (!conversation) {
      conversation = await prisma.chatConversation.create({
        data: {
          userId,
          title: message.slice(0, 30) + '...'
        }
      });
    }

    // 2. Save User Message
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        sender: 'USER',
        content: message.trim()
      }
    });

    // 3. Fetch recent history for message context (last 6 messages)
    const pastMessages = await prisma.chatMessage.findMany({
      where: { conversationId: conversation.id },
      take: 6,
      orderBy: { timestamp: 'asc' }
    });

    const messagesHistory = pastMessages.map(m => ({
      role: m.sender === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content
    }));

    // 4. Build Live Data-Aware Context System Prompt
    const { systemPrompt } = await buildUserContext(req);

    // 5. Stream LLM Completion via SSE
    const fullAssistantText = await streamChatCompletion(res, systemPrompt, messagesHistory);

    // 6. Extract action tag if present e.g. [ACTION:navigate:registration]
    let actionPayload: string | null = null;
    const actionMatch = fullAssistantText.match(/\[ACTION:([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)\]/);
    if (actionMatch) {
      actionPayload = JSON.stringify({ type: actionMatch[1], route: actionMatch[2] });
    }

    // 7. Save Assistant Message in DB
    await prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        sender: 'ASSISTANT',
        content: fullAssistantText,
        action: actionPayload
      }
    });

    // Write audit log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CHAT_ASSISTANT_QUERY',
        details: `Queried AI assistant: "${message.slice(0, 50)}"`
      }
    });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ message: 'Internal server error in chatbot assistant.' });
    }
  }
});

// 2. GET /api/chat/history - Retrieve Conversation Messages
router.get('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const conversation = await prisma.chatConversation.findFirst({
      where: { userId },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (!conversation) {
      return res.json({ conversationId: null, messages: [] });
    }

    return res.json({
      conversationId: conversation.id,
      messages: conversation.messages.map(m => ({
        id: m.id,
        sender: m.sender,
        content: m.content,
        action: m.action ? JSON.parse(m.action) : null,
        timestamp: m.timestamp
      }))
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to retrieve chat history.' });
  }
});

// 3. DELETE /api/chat/history - Clear Chat History
router.delete('/history', authenticateToken, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    await prisma.chatConversation.deleteMany({
      where: { userId }
    });
    return res.json({ message: 'Chat history cleared successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to clear chat history.' });
  }
});

export default router;
