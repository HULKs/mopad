import { useEffect } from "preact/hooks";
import { connect, currentUser, fetchTeams } from "./store";
import { Auth } from "./components/Auth";
import { TalkList } from "./components/TalkList";
import "./mopad.css";

export function App() {
  useEffect(() => {
    fetchTeams();
    connect();
  }, []);

  return <>{currentUser.value ? <TalkList /> : <Auth />}</>;
}
