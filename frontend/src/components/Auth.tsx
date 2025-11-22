import { useState } from "preact/hooks";
import { sendAuth, teams, authError } from "../store";
import { AttendanceMode } from "../types";

export function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [team, setTeam] = useState(teams.value[0] || "");
  const [attendanceMode, setAttendanceMode] = useState(AttendanceMode.OnSite);
  const [password, setPassword] = useState("");
  const [isNotNao, setIsNotNao] = useState(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (mode === "register" && !isNotNao) {
      alert("NAOs are not allowed in MOPAD");
      return;
    }
    sendAuth(
      mode === "login"
        ? { Login: { name, team, password } }
        : {
            Register: { name, team, password, attendance_mode: attendanceMode },
          },
    );
  };

  const isValid = name && password && (mode === "login" || isNotNao);

  return (
    <form id={mode} class="center">
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
        <>
          <div class="registration-checkbox">
            <input
              type="checkbox"
              id="attendance-mode-check"
              checked={attendanceMode == AttendanceMode.Remote}
              onChange={(e) =>
                setAttendanceMode(
                  e.currentTarget.checked
                    ? AttendanceMode.Remote
                    : AttendanceMode.OnSite,
                )
              }
            />
            <label htmlFor="attendance-mode-check">
              Remote Participation only
            </label>

            <div class="registration-checkbox">
              <input
                type="checkbox"
                id="nao-check"
                checked={isNotNao}
                onChange={(e) => setIsNotNao(e.currentTarget.checked)}
              />
              <label htmlFor="nao-check">I'm not a NAO</label>
            </div>
          </div>
        </>
      )}

      <button type="submit" disabled={!isValid} onClick={handleSubmit}>
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
    </form>
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
