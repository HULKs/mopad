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
    onJoin(topicId: string, as: 'expert'|'newbie');
}

export default class TopicList extends React.Component<PublicProps> {
    public render() {
        const { onJoin } = this.props;
        return (
            <div>
                {this.props.topics.map(topic => (
                    <Topic key={topic.id} topic={topic} onJoin={onJoin} />
                ))}
            </div>
        );
    }
}
