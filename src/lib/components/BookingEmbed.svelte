<script lang="ts">
	import type { Company } from '$lib/types';
	let { url, company }: { url: string | null; company: Company } = $props();
</script>

<div class="agenda">
	<iframe title="Agenda One Man Agency" loading="lazy" src={url ?? ''}
	        style="border:0;width:100%;height:640px"></iframe>
</div>
<p class="hint">Lukt het inplannen niet? Bel <a href="tel:{company.telefoon_link}">{company.telefoon}</a> of mail <a href="mailto:{company.email}">{company.email}</a>.</p>
