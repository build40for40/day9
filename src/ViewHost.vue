<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Nerds } from "./data";
import type { Mounted, View } from "./view";

const props = defineProps<{
  nerds: Nerds;
  view: View;
  born: number | null;
  params: Record<string, string>;
  compact?: boolean;
}>();
const emit = defineEmits<{ param: [key: string, value: string | null] }>();

const el = ref<HTMLElement>();
const broken = ref("");
let mounted: Mounted | undefined;

function mount() {
  mounted?.destroy();
  mounted = undefined;
  broken.value = "";
  if (!el.value) return;
  el.value.replaceChildren();
  try {
    mounted = props.view.mount(el.value, {
      nerds: props.nerds,
      born: props.born,
      params: { ...props.params },
      setParam: (key, value) => emit("param", key, value),
      compact: props.compact,
    });
  } catch (error) {
    console.error(error);
    broken.value = String(error);
  }
}

onMounted(mount);
onBeforeUnmount(() => mounted?.destroy());
watch(() => [props.view, props.born, props.compact], mount);
watch(
  () => JSON.stringify(props.params),
  () => mounted?.update?.({ ...props.params }),
);
</script>

<template>
  <div>
    <div ref="el" class="relative" />
    <p v-if="broken" class="rounded-xl border border-nof-line p-6 text-center text-nof-sub">This one fell off the catwalk. <span class="block pt-1 font-mono text-xs text-nof-muted">{{ broken }}</span></p>
  </div>
</template>
