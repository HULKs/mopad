import * as React from "react";
import {
    Card,
    CardActions,
    CardHeader,
    CardMedia,
    CardTitle,
    CardText
} from "material-ui/Card";
import FlatButton from "material-ui/FlatButton";
import Topic from "./topic";
import { FormattedMessage, injectIntl } from "react-intl";
import { AllTopicsQuery } from "../../../mopad-graphql";

interface PublicProps {
    topics: AllTopicsQuery["allTopics"];
}

export default class TopicList extends React.Component<PublicProps> {
    public render() {
        return (
            <div>
                {this.props.topics.map(topic => (
                    <Topic key={topic.id} topic={topic} />
                ))}
            </div>
        );
    }
}
