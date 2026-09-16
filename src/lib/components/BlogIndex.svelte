<script lang="ts">
	import type { Post } from '$lib/types';
	import { nlDate } from '$lib/site';
	// Server-rendered on purpose. The old site rendered its blog index with
	// client-side JS and it was uncrawlable — an explicit audit finding.
	let { posts }: { posts: Post[] } = $props();
</script>

<ul class="postlist">
	{#each posts as p (p.slug)}
		<li>
			<p class="date">{nlDate(p.published_on)} &middot; {p.category ?? ''}</p>
			<h3><a href="/blog/{p.slug}">{p.title}</a></h3>
			<p>{p.intro}</p>
		</li>
	{/each}
</ul>
