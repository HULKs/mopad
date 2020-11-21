import React from "react";
import { Tooltip } from "@material-ui/core";

export default function UserNameWithTeam({ userName, teamName, isYou }) {
  return (
    <Tooltip title={teamName}>
      <span>{isYou ? <b>{userName}</b> : <>{userName}</>}</span>
    </Tooltip>
  );
}
