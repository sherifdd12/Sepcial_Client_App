import { describe, it, expect, vi } from 'vitest';
import { deleteImportedData } from './importHelpers';
import { supabase } from '@/integrations/supabase/client';

describe('deleteImportedData', () => {
  it('should call gte when olderThanHours is provided', async () => {
    // Spy on the 'from' method to verify it's called with the correct table
    const fromSpy = vi.spyOn(supabase, 'from');

    // The final method in the chain (gte) needs to be awaitable and resolve to the expected structure.
    const gteSpy = vi.fn().mockResolvedValue({ error: null });
    // The delete method should return an object containing the gte spy
    const deleteSpy = vi.fn(() => ({ gte: gteSpy }));

    // Mock the return value of 'from' to control the subsequent chain
    // @ts-ignore
    fromSpy.mockReturnValue({
        delete: deleteSpy,
    });

    // Call the function being tested
    await deleteImportedData('customers', 1);

    // Assert that the mocked methods were called as expected
    expect(fromSpy).toHaveBeenCalledWith('customers');
    expect(deleteSpy).toHaveBeenCalled();
    expect(gteSpy).toHaveBeenCalled();
  });
});