import IconButton from "@material-ui/core/Toolbar/Toolbar";
import LogoutIcon from "@material-ui/icons/ExitToApp";
import * as React from "react";
import { RouteComponentProps, withRouter } from "react-router";

function DisconnectedLogoutButton({ history }: RouteComponentProps<{}>) {
    return (
        <IconButton color="inherit" onClick={() => history.push("/logout")}>
            <LogoutIcon />
        </IconButton>
    );
}

export default withRouter(DisconnectedLogoutButton);
