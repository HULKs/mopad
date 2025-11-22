import { useState } from "preact/hooks";
import { sendAuth, teams, authError } from "../store";

export function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [team, setTeam] = useState(teams.value[0] || "");
  const [password, setPassword] = useState("");
  const [isNotNao, setIsNotNao] = useState(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (mode === "register" && !isNotNao) {
      alert("NAOs are not allowed in MOPAD");
      return;
    }
    const payload = { name, team, password };
    sendAuth(mode === "login" ? { Login: payload } : { Register: payload });
  };

  const isValid = name && password && (mode === "login" || isNotNao);

  return (
    <div id={mode} class="center">
      <h1>MOPAD</h1>
      <h2>Moderated Organization PAD (powerful, agile, distributed)</h2>
      <h3>{mode === "login" ? "Login" : "Register"}</h3>

      {authError.value && <div style={{ color: "red" }}>{authError.value}</div>}

      <input
        placeholder="Your Name"
        value={name}
        onInput={(e) => setName(e.currentTarget.value)}
      />
      {mode === "register" && (
        <div class="hint">Unique in your team, visible to everyone</div>
      )}

      <select value={team} onChange={(e) => setTeam(e.currentTarget.value)}>
        {teams.value.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {mode === "register" && <div class="hint">Visible to everyone</div>}

      <input
        type="password"
        placeholder="Password"
        value={password}
        onInput={(e) => setPassword(e.currentTarget.value)}
      />

      {mode === "register" && (
        <div class="i-am-not-a-nao">
          <input
            type="checkbox"
            id="nao-check"
            checked={isNotNao}
            onChange={(e) => setIsNotNao(e.currentTarget.checked)}
          />
          <label htmlFor="nao-check">I'm not a NAO</label>
        </div>
      )}

      <button disabled={!isValid} onClick={handleSubmit}>
        {mode === "login" ? "Login" : "Register"}
      </button>

      <div class="login-register-switcher">
        {mode === "login"
          ? "Don't have an account? "
          : "Already have an account? "}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode(mode === "login" ? "register" : "login");
          }}
        >
          {mode === "login" ? "Register" : "Login"}
        </a>
      </div>

      <Footer />
    </div>
  );
}

function Footer() {
  return (
    <div class="footer">
      <a href="https://rohow.de/2025/de/imprint.html" target="_blank">
        Imprint/Impressum
      </a>
      <br />
      <a href="https://rohow.de/2025/de/privacy_policy.html" target="_blank">
        Privacy Policy
      </a>
    </div>
  );
}
