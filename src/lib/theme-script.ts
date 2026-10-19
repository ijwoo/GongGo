/**
 * 첫 화면을 그리기 전에 실행되는 테마 스크립트(layout의 <head>에 넣는다).
 * 저장된 선택 → 없으면 시스템 설정 순으로 html[data-theme]을 정해 깜빡임을 막는다.
 * 키 이름은 lib/theme.ts와 같아야 한다.
 */
export const THEME_STORAGE_KEY = "gonggoham:theme";

export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var d=p==="dark"||((p===null||p==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
