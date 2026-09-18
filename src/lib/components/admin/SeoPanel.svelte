<script lang="ts">
	import { SITE } from '$lib/site';
	import { analyse, grade, type Subject } from '$lib/seo';

	/**
	 * The SEO panel under an editor: what this page will look like in Google,
	 * and what is still wrong with it.
	 *
	 * It updates while typing because every field it reads is already bound state
	 * in the editor — the panel itself holds nothing. The point is that the
	 * editor sees the truncated result before saving, rather than discovering a
	 * cut-off title in a search result weeks later.
	 */
	interface Props {
		subject: Subject;
		/** A page kept out of Google. There is no result to grade, so it is not graded. */
		noindex?: boolean;
	}

	let { subject, noindex = false }: Props = $props();

	const result = $derived(analyse(subject));
	const verdict = $derived(grade(result.score));

	// The breadcrumb-style URL Google shows instead of the raw path.
	const crumbUrl = $derived(
		SITE.replace(/^https?:\/\//, '') + subject.path.replace(/\//g, ' › ').replace(/ › $/, '')
	);

	let open = $state(true);
	const problems = $derived(result.checks.filter((c) => c.status !== 'ok').length);
</script>

<section class="cms-seo">
{#if noindex}
	<h2 style="margin:0;font-size:16px">Vindbaarheid</h2>
	<p class="cms-hint" style="margin:.35rem 0 0">
		Deze pagina staat op “niet tonen in Google”. Ze verschijnt niet in de zoekresultaten en
		staat niet in de sitemap, dus er valt niets te scoren.
	</p>
{:else}
	<header>
		<button type="button" class="cms-seo-toggle" onclick={() => (open = !open)}
		        aria-expanded={open}>
			<h2>Vindbaarheid</h2>
			<span class="cms-badge {verdict.status === 'fail' ? 'bad' : verdict.status}">
				{result.score}/100 · {verdict.label}
			</span>
			<span class="cms-seo-caret">{open ? '−' : '+'}</span>
		</button>
		<p class="cms-hint" style="margin:.2rem 0 0">
			{#if problems}
				{problems} aandachtspunt{problems === 1 ? '' : 'en'}. Niets hiervan blokkeert opslaan.
			{:else}
				Alles in orde.
			{/if}
		</p>
	</header>

	{#if open}
		<!-- The preview is deliberately styled like a search result, not like the
		     rest of the CMS: it is a picture of somewhere else. -->
		<div class="cms-serp">
			<p class="cms-serp-url">{crumbUrl}</p>
			<p class="cms-serp-title">{result.preview.title || 'Zonder titel'}</p>
			<p class="cms-serp-desc">
				{result.preview.description || 'Zonder omschrijving kiest Google zelf een stuk tekst.'}
			</p>
		</div>

		<ul class="cms-checks">
			{#each result.checks as c (c.key)}
				<li class={c.status}>
					<span class="cms-check-icon" aria-hidden="true">
						{c.status === 'ok' ? '✓' : c.status === 'warn' ? '!' : '×'}
					</span>
					<span class="cms-sr">
						{c.status === 'ok' ? 'In orde:' : c.status === 'warn' ? 'Let op:' : 'Fout:'}
					</span>
					<span><strong>{c.label}</strong> — {c.detail}</span>
				</li>
			{/each}
		</ul>
	{/if}
{/if}
</section>
