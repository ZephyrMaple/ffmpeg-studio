import { ref } from 'vue'

/**
 * 输入校验 composable
 * 用法：
 *   const { error, check } = useValidate(validateNumber)
 *   <el-input v-model="val" @blur="check(val)" :class="{ 'is-error': error }" />
 *   <span v-if="error">格式错误，请重新输入</span>
 */
export function useValidate(validator) {
  const error = ref(false)
  function check(v) {
    error.value = false
    if (!v || !v.trim()) return
    const msg = validator(v.trim())
    if (msg !== null) error.value = true
  }
  return { error, check }
}
