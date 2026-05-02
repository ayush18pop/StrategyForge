import { describe, it, expect } from 'vitest';
import { getUserIdFromRequest } from '../lib/auth';

function makeRequest(authHeader?: string): Request {
    return new Request('http://localhost/api/test', {
        headers: authHeader ? { Authorization: authHeader } : {},
    });
}

describe('getUserIdFromRequest', () => {
    it('extracts userId from valid Bearer token', () => {
        const req = makeRequest('Bearer 507f1f77bcf86cd799439011');
        expect(getUserIdFromRequest(req)).toBe('507f1f77bcf86cd799439011');
    });

    it('returns null when Authorization header missing', () => {
        expect(getUserIdFromRequest(makeRequest())).toBeNull();
    });

    it('returns null for non-Bearer schemes', () => {
        expect(getUserIdFromRequest(makeRequest('Basic dXNlcjpwYXNz'))).toBeNull();
    });

    it('returns null for empty token', () => {
        expect(getUserIdFromRequest(makeRequest('Bearer '))).toBeNull();
    });
});
