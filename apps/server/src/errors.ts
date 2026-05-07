import type { FastifyReply } from 'fastify';
import { SchemaVersionMismatchError, SchemaParseError, getSchemaVersionErrorMessage } from '@dungeon/contracts';

export class ConcurrentModificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrentModificationError';
  }
}

export function handleRouteError(error: unknown, reply: FastifyReply): boolean {
  if (error instanceof SchemaVersionMismatchError) {
    reply.code(400).send({
      error: 'Incompatible save file',
      code: 'INCOMPATIBLE_SAVE_FILE',
      message: getSchemaVersionErrorMessage(error.foundVersion),
    });
    return true;
  }
  if (error instanceof SchemaParseError) {
    reply.code(400).send({
      error: 'Invalid save file',
      code: 'INVALID_SAVE_FILE',
      message: error.message,
    });
    return true;
  }
  if (error instanceof ConcurrentModificationError) {
    reply.code(409).send({
      error: 'Concurrent modification',
      message: error.message,
    });
    return true;
  }
  return false;
}
