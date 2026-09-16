<script lang="ts">
	import FamilyPage from '$components/FamilyPage.svelte';
	let { data } = $props();
</script>

<FamilyPage page={data.page} family="diensten" />
