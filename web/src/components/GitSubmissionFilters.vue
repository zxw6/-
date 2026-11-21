<script setup>
import { computed } from 'vue';
import { useI18n } from '../i18n/index.js';
import { branchOptionsFromItems, userOptionsFromItems } from '../utils/git-submission-filter.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
  userQuery: { type: String, default: '' },
  branchQuery: { type: String, default: '' },
});

const emit = defineEmits(['update:userQuery', 'update:branchQuery']);

const { t } = useI18n();

const userListId = `git-user-dl-${Math.random().toString(36).slice(2, 8)}`;
const branchListId = `git-branch-dl-${Math.random().toString(36).slice(2, 8)}`;

const userOptions = computed(() => userOptionsFromItems(props.items));
const branchOptions = computed(() => branchOptionsFromItems(props.items));

const userModel = computed({
  get: () => props.userQuery,
  set: (v) => emit('update:userQuery', v),
});

const branchModel = computed({
  get: () => props.branchQuery,
  set: (v) => emit('update:branchQuery', v),
});
</script>

<template>
  <div class="git-filters">
    <label class="git-filters__item">
      <span>{{ t('gitFilterUser') }}</span>
      <input
        v-model="userModel"
        type="search"
        class="git-filters__input"
        :list="userListId"
        :placeholder="t('gitFilterUserPlaceholder')"
      />
      <datalist :id="userListId">
        <option v-for="opt in userOptions" :key="opt" :value="opt" />
      </datalist>
    </label>
    <label class="git-filters__item git-filters__item--grow">
      <span>{{ t('gitFilterBranch') }}</span>
      <input
        v-model="branchModel"
        type="search"
        class="git-filters__input"
        :list="branchListId"
        :placeholder="t('gitFilterBranchPlaceholder')"
      />
      <datalist :id="branchListId">
        <option v-for="opt in branchOptions" :key="opt" :value="opt" />
      </datalist>
    </label>
  </div>
</template>

<style scoped>
.git-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 0 0 12px;
}

.git-filters__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
  min-width: 160px;
}

.git-filters__item--grow {
  flex: 1;
  min-width: 180px;
}

.git-filters__input {
  background: var(--surface-subtle, var(--bg));
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  padding: 7px 10px;
  font-size: 13px;
  font-family: inherit;
}

.git-filters__input:focus {
  outline: none;
  border-color: #539bf5;
}
</style>