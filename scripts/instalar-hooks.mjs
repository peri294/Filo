// Corre en `npm install` (script "prepare"): activa los hooks versionados de .githooks/.
// Fuera de un repo git (por ejemplo, el build de Vercel) no hace nada.
import { execSync } from "node:child_process";

try {
  execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
} catch {
  // Sin git: no hay hooks que instalar.
}
