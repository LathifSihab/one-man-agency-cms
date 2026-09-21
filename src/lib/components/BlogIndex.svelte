<script lang="ts">
	import type { Post } from '$lib/types';
	import { resolveImage } from '$lib/images';
	// Server-rendered on purpose. The old site rendered its blog index with
	// client-side JS and it was uncrawlable — an explicit audit finding.
	//
	// A card grid, and no dates on the cards: a marketing article does not go
	// stale the way a news item does, and a visible date makes a good piece from
	// last spring look neglected. published_on still orders the list and still
	// goes out in the BlogPosting schema, where it is the search engine's to
	// read rather than the reader's.
	let { posts }: { posts: Post[] } = $props();
</script>

<ul class="postlist postgrid">
	{#each posts as p (p.slug)}
		<li class:met-beeld={p.image_url}>
			{#if p.image_url}
				<img class="postthumb" src={resolveImage(p.image_url)} alt="" width="160" height="120" loading="lazy" />
			{/if}
			<div>
			{#if p.category}<p class="date">{p.category}</p>{/if}
			<h3><a href="/blog/{p.slug}">{p.title}</a></h3>
			<p>{p.intro}</p>
			</div>
		</li>
	{/each}
</ul>
