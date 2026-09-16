<script lang="ts">
	import type { Post } from '$lib/types';
	import { nlDate } from '$lib/site';
	import { resolveImage } from '$lib/images';
	// Server-rendered on purpose. The old site rendered its blog index with
	// client-side JS and it was uncrawlable — an explicit audit finding.
	let { posts }: { posts: Post[] } = $props();
</script>

<ul class="postlist">
	{#each posts as p (p.slug)}
		<li class:met-beeld={p.image_url}>
			{#if p.image_url}
				<img class="postthumb" src={resolveImage(p.image_url)} alt="" width="160" height="120" loading="lazy" />
			{/if}
			<div>
			<p class="date">{nlDate(p.published_on)} &middot; {p.category ?? ''}</p>
			<h3><a href="/blog/{p.slug}">{p.title}</a></h3>
			<p>{p.intro}</p>
			</div>
		</li>
	{/each}
</ul>
