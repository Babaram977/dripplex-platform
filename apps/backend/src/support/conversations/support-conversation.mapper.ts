import type { SupportConversationDto, SupportMessageDto } from '@dripplex/types';
import type { SupportConversation, SupportMessage } from '@prisma/client';

/**
 * `seq` is a 64-bit database sequence and JSON has no integer type that holds
 * one safely. It crosses the wire as a string rather than a number, which is
 * correct for all values instead of correct for the first 2^53 of them.
 */
export function toSupportMessageDto(message: SupportMessage): SupportMessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    seq: message.seq.toString(),
    authorType: message.authorType,
    authorId: message.authorId,
    body: message.body,
    visibility: message.visibility,
    redactedAt: message.redactedAt ? message.redactedAt.toISOString() : null,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toSupportConversationDto(
  conversation: SupportConversation,
): SupportConversationDto {
  return {
    id: conversation.id,
    ticketId: conversation.ticketId,
    createdAt: conversation.createdAt.toISOString(),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}
