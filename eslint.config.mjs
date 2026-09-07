import tseslint from 'typescript-eslint';
export default [{ignores:['node_modules/**','dist/**','.qa/**']},{files:['backend/**/*.ts','src/**/*.{ts,tsx}','tests/**/*.ts'],languageOptions:{parser:tseslint.parser},rules:{'no-debugger':'error','no-constant-condition':'error','no-duplicate-case':'error','no-unreachable':'error','constructor-super':'error','valid-typeof':'error'}}];

