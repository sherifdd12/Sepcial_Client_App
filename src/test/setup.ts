import { vi } from 'vitest';

// Mock for window.matchMedia, which is required by some UI components
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock the entire Supabase client to be fully chainable and awaitable
vi.mock('@supabase/supabase-js', () => {
    const mockSupabaseClient = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: '123' }, error: null }),
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        // Add a 'then' method to the mock to allow it to be awaited, resolving with a default success state.
        then: vi.fn((resolve) => resolve({ data: [], error: null })),
    };

    const createClient = vi.fn(() => mockSupabaseClient);

    return { createClient };
});