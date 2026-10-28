<template>
  <router-view />
</template>

<script lang="ts" setup>
import { initStorage } from './services/storage/indexedDb';

initStorage();
</script>
<style lang="postcss" scoped></style>
