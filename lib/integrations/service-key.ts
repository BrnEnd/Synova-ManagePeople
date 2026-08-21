import { createHmac } from 'node:crypto';

export function serviceKeyHash(value: string, secret: string) {
  return createHmac('sha256', secret).update(`service-key:${value}`).digest('hex');
}
