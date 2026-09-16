<script lang="ts">
	import Seo from '$components/Seo.svelte';
	import PageHead from '$components/PageHead.svelte';
	let { data } = $props();
	const b = $derived(data.settings.company);
</script>

<!--
  NEW COPY — not migrated from the reference build. See /bedankt.
  Shown when a submission could not be stored, so a lead is never silently lost.
-->
<Seo seoTitle="Het versturen lukte niet — One Man Agency"
     metaDescription="Je bericht kon niet verstuurd worden. Bel of mail rechtstreeks."
     path="/formulier-fout" noindex={true} />

<PageHead title="Het versturen lukte niet"
          intro="Er ging iets mis bij het verwerken van je bericht. Je gegevens zijn niet bewaard." />

<section><div class="wrap"><div class="prose">
	<p>Probeer het zo meteen opnieuw, of neem rechtstreeks contact op:
		bel <a href="tel:{b.telefoon_link}">{b.telefoon}</a> of mail
		<a href="mailto:{b.email}">{b.email}</a>. Zo gaat je vraag zeker niet verloren.</p>
	<div class="btns">
		<a class="btn" href="/contact">Terug naar het contactformulier</a>
		<a class="btn btn-ghost" href="/">Naar de startpagina</a>
	</div>
</div></div></section>
