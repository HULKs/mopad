import * as React from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import TalkList from "./TalkList";

export class Home extends React.Component {
    public render() {
        return (
            <div>
                <h1>
                    <FormattedMessage id="app.home" />
                </h1>
                <TalkList />
            </div>
        );
    }
}
