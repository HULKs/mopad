import { useState, useEffect } from "react";
import firebase from "firebase/app";
import { useAuthState } from "react-firebase-hooks/auth";

export default function useDocuments(users, usersLoading, usersError) {
  const [userState, userStateLoading, userStateError] = useAuthState(
    firebase.auth()
  );
  const [userId, setUserId] = useState();
  const [user, setUser] = useState();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!usersLoading && !usersError && !userStateLoading) {
      if (!userState) {
        setUserId();
        setUser();
        setLoading(false);
        return;
      }

      const matching = Object.entries(users).find(
        ([_, user]) => user.authenticationId === userState.uid
      );
      if (!matching) {
        return;
      }

      const [matchingUserId, matchingUser] = matching;
      setUserId(matchingUserId);
      setUser(matchingUser);
      setLoading(false);
    }
  }, [usersLoading, usersError, userStateLoading, users, userState]);

  return [userId, user, loading, userStateError];
}
