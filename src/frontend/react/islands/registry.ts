import { defineIslandRegistry } from '@absolutejs/absolute';
import { AnalyzeForm } from './AnalyzeForm';
import { ThemeToggle } from './ThemeToggle';
import { VitalsChart } from './VitalsChart';

export const islandRegistry = defineIslandRegistry({
	react: {
		AnalyzeForm,
		ThemeToggle,
		VitalsChart
	}
});

export default islandRegistry;
