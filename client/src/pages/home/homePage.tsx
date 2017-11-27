import * as React from "react";
import { FormattedMessage, injectIntl } from "react-intl";
import TopicList from "./topicList";
import TopicAdd from "./topicAdd";

export class Home extends React.Component {
    public render() {
        return (
            <div style={{ padding: "2em" }}>
                <h1>
                    <FormattedMessage id="app.home" />
                </h1>
                <TopicList
                    topics={[
                        { name: "Bananen", description: "blub" },
                        { name: "Erdbeeren", description: "lala" }
                    ]}
                />
                <TopicAdd />
            </div>
        );
    }
}
