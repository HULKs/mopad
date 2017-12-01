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
import { TopicDisplayFragment } from "../../../mopad-graphql";
import { ParticipationType, ParticipationChange } from "../../business/types";

interface PublicProps {
    topics: TopicDisplayFragment[];
    onChangeParticipation(
        topicId: string,
        as: ParticipationType,
        action: ParticipationChange
    );
}

export default class TopicList extends React.Component<PublicProps> {
    public render() {
        const { onChangeParticipation } = this.props;
        return (
            <div>
                {this.props.topics.map(topic => (
                    <Topic
                        key={topic.id}
                        topic={topic}
                        onChangeParticipation={onChangeParticipation}
                    />
                ))}
            </div>
        );
    }
}
