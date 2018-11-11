import { RouteComponentProps, withRouter } from "react-router";
import { User, withUser } from "../business/withUser";
import IconButton from "@material-ui/core/Toolbar/Toolbar";
import FullScreenIcon from "@material-ui/icons/Fullscreen";
import * as React from "react";

function FullScreenButton({ history, user }: { user: User } & RouteComponentProps<{}>) {
    if (!user.isAdmin) return null;

    return (
        <IconButton color="inherit" onClick={() => history.push("?fullscreen")}>
            <FullScreenIcon />
        </IconButton>
    );
}

export default withUser<{}>(withRouter(FullScreenButton));
