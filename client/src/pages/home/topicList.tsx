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
import { TopicViewModel } from "../../business/topics";
import { ParticipationType, ParticipationChange } from "../../business/types";

interface PublicProps {
    topics: TopicViewModel[];
    onChangeParticipation?(
        topicId: string,
        as: ParticipationType,
        action: ParticipationChange
    );
    onDeleteTopic?(topicId: string);
}

export default class TopicList extends React.Component<PublicProps> {
    public render() {
        const { onChangeParticipation, onDeleteTopic } = this.props;
        return (
            <div className="topicList">
                {this.props.topics.map(topic => (
                    <Topic
                        key={topic.id}
                        topic={topic}
                        onChangeParticipation={onChangeParticipation}
                        onDelete={onDeleteTopic}
                    />
                ))}
            </div>
        );
    }
}
