import * as React from "react";
import { RouterProps, withRouter } from "react-router";
import { injectIntl, InjectedIntl } from "react-intl";
import { compose } from "react-apollo";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";

interface AppMenuProps extends RouterProps {
    onClick?();
    open: boolean;
    anchorEl: HTMLElement;
    intl: InjectedIntl;
}
class DisconnectedAppMenu extends React.Component<AppMenuProps> {
    constructor(props) {
        super(props);
        this.onSignOutClick = this.onSignOutClick.bind(this);
    }

    public render() {
        const { open, intl, anchorEl } = this.props;
        return (
            <Menu
                open={open}
                anchorEl={anchorEl}
                anchorOrigin={{
                    vertical: "bottom",
                    horizontal: "left"
                }}
                transformOrigin={{
                    vertical: "bottom",
                    horizontal: "left"
                }}
            >
                <MenuItem onClick={this.onSignOutClick}>
                    {intl.formatMessage({
                        id: "app.menu.signOut"
                    })}
                </MenuItem>
            </Menu>
        );
    }

    private onSignOutClick() {
        this.props.history.push("/logout");
        this.props.onClick();
    }
}

export default compose(
    withRouter,
    injectIntl
)(DisconnectedAppMenu);
