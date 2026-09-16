<script lang="ts">
	import { enhance } from '$app/forms';
	let { data, form } = $props();

	const LABEL: Record<string, string> = {
		site: 'Website', logos: "Klantenlogo's", blog: 'Blogafbeeldingen'
	};

	function kb(bytes: number): string {
		return bytes > 1_000_000
			? `${(bytes / 1_048_576).toFixed(1)} MB`
			: `${Math.max(1, Math.round(bytes / 1024))} kB`;
	}

	let copied = $state('');
	async function copy(path: string) {
		try {
			await navigator.clipboard.writeText(`/assets/${path.replace(/^site\//, '')}`);
			copied = path;
			setTimeout(() => (copied = ''), 2000);
		} catch {
			copied = '';
		}
	}
</script>

<h1>Afbeeldingen</h1>
<p class="cms-lead">
	Afbeeldingen worden bij het publiceren mee in de site gebouwd, zodat bezoekers niets extra
	hoeven te laden.
</p>

{#if form?.message}<div class="cms-error">{form.message}</div>{/if}
{#if form?.saved}<div class="cms-ok">Klaar. Publiceer om het live te zetten.</div>{/if}

<div class="cms-card" style="margin-bottom:1.5rem">
	<h3>Nieuwe afbeelding</h3>
	<form method="POST" action="?/upload" enctype="multipart/form-data" use:enhance>
		<div class="cms-two">
			<div class="cms-field">
				<label for="u-file">Bestand</label>
				<input id="u-file" name="file" type="file"
				       accept="image/png,image/jpeg,image/webp,image/svg+xml,image/avif" required />
				<p class="cms-hint">PNG, JPEG, WebP, AVIF of SVG. Maximaal 8 MB.</p>
			</div>
			<div class="cms-field">
				<label for="u-prefix">Map</label>
				<select id="u-prefix" name="prefix">
					<option value="site">Website</option>
					<option value="blog">Blogafbeeldingen</option>
					<option value="logos">Klantenlogo's</option>
				</select>
			</div>
		</div>
		<button class="cms-btn" type="submit">Uploaden</button>
	</form>
</div>

{#each data.folders as folder (folder.prefix)}
	<h2>{LABEL[folder.prefix]} <span class="cms-meta">({folder.files.length})</span></h2>
	{#if !folder.files.length}
		<p class="cms-hint">Nog niets in deze map.</p>
	{:else}
		<div class="cms-logos">
			{#each folder.files as file (file.path)}
				<div class="cms-logo">
					<img src={file.url} alt={file.name} />
					<p class="cms-hint" style="word-break:break-all;margin:.3rem 0">{file.name}</p>
					<p class="cms-meta">{kb(file.size)}</p>
					<div class="cms-actions" style="justify-content:center">
						<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
						        onclick={() => copy(file.path)}>
							{copied === file.path ? 'Gekopieerd' : 'Kopieer pad'}
						</button>
						<form method="POST" action="?/delete" use:enhance
						      onsubmit={(e) => { if (!confirm(`${file.name} verwijderen?`)) e.preventDefault(); }}>
							<input type="hidden" name="path" value={file.path} />
							<button class="cms-btn cms-btn-danger cms-btn-small" type="submit">Wis</button>
						</form>
					</div>
				</div>
			{/each}
		</div>
	{/if}
{/each}
