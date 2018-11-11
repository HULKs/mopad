import * as React from "react";
import Topic from "./topic";
import { TopicViewModel, TopicUpdate } from "../../business/topics";
import { ParticipationType, ParticipationChange } from "../../business/types";

interface PublicProps {
    topics: TopicViewModel[];
    onChangeParticipation?(topicId: string, as: ParticipationType, action: ParticipationChange);
    onUpdateTopic?(update: TopicUpdate);
    onDeleteTopic?(topicId: string);
}

export default class TopicList extends React.Component<PublicProps> {
    public render() {
        const { onChangeParticipation, onUpdateTopic, onDeleteTopic } = this.props;
        return (
            <div className="topicList">
                {this.props.topics.map(topic => (
                    <Topic
                        key={topic.id}
                        topic={topic}
                        onChangeParticipation={onChangeParticipation}
                        onUpdate={onUpdateTopic}
                        onDelete={onDeleteTopic}
                    />
                ))}
            </div>
        );
    }
}
