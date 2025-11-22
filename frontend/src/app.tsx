import { useEffect } from "preact/hooks";
import { connect, currentUser, fetchTeams, authError } from "./store";
import { Auth } from "./components/Auth";
import { TalkList } from "./components/TalkList";
import { Loading } from "./components/Loading";
import "./mopad.css";

export function App() {
  useEffect(() => {
    fetchTeams();
    connect();
  }, []);

  const hasToken = !!localStorage.getItem("reloginToken");
  const isRestoring = hasToken && !currentUser.value && !authError.value;

  if (isRestoring) {
    return <Loading />;
  }

  return <>{currentUser.value ? <TalkList /> : <Auth />}</>;
}
