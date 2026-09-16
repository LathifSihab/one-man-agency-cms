<script lang="ts">
	/**
	 * Add / remove / reorder editor for a repeating structure (FAQ, prices,
	 * packages, figures, testimonials, navigation, socials).
	 *
	 * The CMS spec is explicit: never a raw JSON textarea. The caller supplies a
	 * field spec, so the same component serves every repeating structure without
	 * any of them leaking JSON into the interface.
	 */
	export interface FieldSpec {
		key: string;
		label: string;
		type?: 'text' | 'textarea' | 'checkbox' | 'list';
		placeholder?: string;
	}

	interface Props {
		label: string;
		fields: FieldSpec[];
		rows: Record<string, unknown>[];
		/** Label for one row, e.g. "vraag". */
		noun?: string;
		/** Reads a short summary for the row header. */
		summary?: (row: Record<string, unknown>) => string;
	}

	let {
		label,
		fields,
		rows = $bindable(),
		noun = 'rij',
		summary
	}: Props = $props();

	function blank(): Record<string, unknown> {
		const row: Record<string, unknown> = {};
		for (const f of fields) {
			row[f.key] = f.type === 'checkbox' ? false : f.type === 'list' ? [] : '';
		}
		return row;
	}

	function add() {
		rows = [...rows, blank()];
	}

	function remove(i: number) {
		rows = rows.filter((_, k) => k !== i);
	}

	function move(i: number, by: number) {
		const to = i + by;
		if (to < 0 || to >= rows.length) return;
		const next = [...rows];
		[next[i], next[to]] = [next[to], next[i]];
		rows = next;
	}

	/** `list` fields are edited as one item per line. */
	function linesOf(value: unknown): string {
		return Array.isArray(value) ? value.join('\n') : '';
	}

	function setLines(i: number, key: string, text: string) {
		rows[i][key] = text.split('\n').map((l) => l.trim()).filter(Boolean);
	}
</script>

<fieldset class="cms-field" style="border:0;padding:0;margin-inline:0">
	<legend style="font-weight:600;padding:0">{label}</legend>
	<div class="cms-rows">
		{#each rows as row, i (i)}
			<div class="cms-row">
				<div class="cms-row-head">
					<strong>{noun} {i + 1}{summary && summary(row) ? ` — ${summary(row)}` : ''}</strong>
					<span class="cms-actions">
						<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
						        onclick={() => move(i, -1)} disabled={i === 0}
						        aria-label="Verplaats omhoog">↑</button>
						<button type="button" class="cms-btn cms-btn-ghost cms-btn-small"
						        onclick={() => move(i, 1)} disabled={i === rows.length - 1}
						        aria-label="Verplaats omlaag">↓</button>
						<button type="button" class="cms-btn cms-btn-danger cms-btn-small"
						        onclick={() => remove(i)}>Verwijderen</button>
					</span>
				</div>

				{#each fields as f (f.key)}
					{#if f.type === 'checkbox'}
						<label style="font-weight:500">
							<input type="checkbox" bind:checked={rows[i][f.key] as boolean}
							       style="width:auto;margin-right:.4rem" />
							{f.label}
						</label>
					{:else if f.type === 'textarea'}
						<label style="font-weight:500">{f.label}
							<textarea bind:value={rows[i][f.key] as string} rows="3"
							          placeholder={f.placeholder ?? ''}></textarea>
						</label>
					{:else if f.type === 'list'}
						<label style="font-weight:500">{f.label}
							<textarea rows="4" placeholder="Eén item per regel"
							          value={linesOf(row[f.key])}
							          oninput={(e) => setLines(i, f.key, e.currentTarget.value)}></textarea>
							<span class="cms-hint">Eén item per regel.</span>
						</label>
					{:else}
						<label style="font-weight:500">{f.label}
							<input type="text" bind:value={rows[i][f.key] as string}
							       placeholder={f.placeholder ?? ''} />
						</label>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
	<div class="cms-actions" style="margin-top:.6rem">
		<button type="button" class="cms-btn cms-btn-ghost cms-btn-small" onclick={add}>
			+ {noun} toevoegen
		</button>
	</div>
</fieldset>
