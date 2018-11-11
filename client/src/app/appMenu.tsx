import * as React from "react";
import { RouterProps, withRouter } from "react-router";
import { injectIntl, InjectedIntl } from "react-intl";
import { compose } from "react-apollo";
import Paper from "material-ui/Paper";
import Menu from "material-ui/Menu";
import MenuItem from "material-ui/MenuItem";

interface AppMenuProps extends RouterProps {
    onClick?();
    open: boolean;
    intl: InjectedIntl;
}
class DisconnectedAppMenu extends React.Component<AppMenuProps> {
    constructor(props) {
        super(props);
        this.onSignOutClick = this.onSignOutClick.bind(this);
    }

    public render() {
        const { open, intl } = this.props;
        return (
            <Paper style={{ position: "absolute", zIndex: 100 }}>
                <Menu
                    style={{ display: open ? "block" : "none" }}
                    width={200}
                    autoWidth={false}
                >
                    <MenuItem
                        primaryText={intl.formatMessage({
                            id: "app.menu.signOut"
                        })}
                        onClick={this.onSignOutClick}
                    />
                </Menu>
            </Paper>
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
