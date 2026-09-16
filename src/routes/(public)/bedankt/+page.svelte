<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import PageHead from '$components/PageHead.svelte';
	let { data } = $props();
	const b = $derived(data.settings.company);
</script>

<!--
  NEW COPY — not migrated from the reference build.
  Forms now post to Supabase (Q1) instead of Formspree, which needs a landing
  page for a successful submission. Kept deliberately short; the client should
  review the wording. noindex, and excluded from the sitemap.
-->
<Seo seoTitle="Bedankt voor je bericht — One Man Agency"
     metaDescription="Je bericht is goed aangekomen. Niels neemt binnen twee werkdagen contact op."
     path="/bedankt" noindex={true} />

<PageHead title="Bedankt voor je bericht"
          intro="Je bericht is goed aangekomen. Ik neem binnen twee werkdagen contact op." />

<section><div class="wrap"><div class="prose">
	<p>Heb je er nog iets aan toe te voegen, of is het dringend? Bel gerust
		<a href="tel:{b.telefoon_link}">{b.telefoon}</a> of mail
		<a href="mailto:{b.email}">{b.email}</a>.</p>
	<div class="btns">
		<a class="btn" href="/">Terug naar de startpagina</a>
		<a class="btn btn-ghost" href="/blog">Lees de marketingtips</a>
	</div>
</div></div></section>
