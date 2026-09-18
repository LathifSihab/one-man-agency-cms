import { fail } from '@sveltejs/kit';
import { adminDb } from '$lib/server/admin';
import { requireConfirmation } from '$lib/server/confirm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const { data } = await adminDb()
		.from('submissions')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(200);

	return { submissions: data ?? [] };
};

export const actions: Actions = {
	read: async ({ request }) => {
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const { error } = await adminDb()
			.from('submissions')
			.update({ is_read: form.get('unread') !== 'on' })
			.eq('id', id);
		if (error) return fail(500, { message: error.message });
		return { saved: true };
	},

	delete: async ({ request }) => {
		const form = await request.formData();
		const stop = requireConfirmation(form);
		if (stop) return stop;

		const { error } = await adminDb()
			.from('submissions')
			.delete()
			.eq('id', String(form.get('id') ?? ''));
		if (error) return fail(500, { message: error.message });
		return { saved: true };
	}
};
