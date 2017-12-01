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
import { FormattedMessage, injectIntl, InjectedIntl } from "react-intl";
import { TopicViewModel } from "../../business/topics";
import { ParticipationType, ParticipationChange } from "../../business/types";

interface PublicProps {
    topic: TopicViewModel;
    onChangeParticipation(
        topicId: string,
        as: ParticipationType,
        action: ParticipationChange
    );
}

interface IntlProps {
    intl: InjectedIntl;
}

export class DisconnectedTopic extends React.Component<
    PublicProps & IntlProps
> {
    public render() {
        const { onChangeParticipation, intl, topic } = this.props;
        return (
            <Card className="topic card">
                <CardTitle title={topic.title} subtitle={topic.description} />
                <CardText>
                    <div>
                        <FormattedMessage id="topic.label.expert" />:{" "}
                        {topic.experts.map(u => u.name).join(", ")}
                    </div>
                    <div>
                        <FormattedMessage id="topic.label.newbie" />:{" "}
                        {topic.newbies.map(u => u.name).join(", ")}
                    </div>
                </CardText>
                <CardActions>
                    <TopicActions
                        topic={topic}
                        onChangeParticipation={onChangeParticipation}
                        intl={intl}
                    />
                </CardActions>
            </Card>
        );
    }
}

function TopicActions(props: {
    topic: TopicViewModel;
    onChangeParticipation: PublicProps["onChangeParticipation"];
    intl: InjectedIntl;
}) {
    const { topic, onChangeParticipation, intl } = props;

    if (topic.userIsExpert) {
        return (
            <FlatButton
                primary={true}
                onClick={() =>
                    onChangeParticipation(topic.id, "expert", "leave")
                }
                label={intl.formatMessage({ id: "topic.leave.expert" })}
            />
        );
    }

    if (topic.userIsNewbie) {
        return (
            <FlatButton
                primary={true}
                onClick={() =>
                    onChangeParticipation(topic.id, "newbie", "leave")
                }
                label={intl.formatMessage({ id: "topic.leave.newbie" })}
            />
        );
    }

    return (
        <div>
            <FlatButton
                onClick={() =>
                    onChangeParticipation(topic.id, "expert", "join")
                }
                label={intl.formatMessage({ id: "topic.join.expert" })}
            />
            <FlatButton
                onClick={() =>
                    onChangeParticipation(topic.id, "newbie", "join")
                }
                label={intl.formatMessage({ id: "topic.join.newbie" })}
            />
        </div>
    );
}

export default injectIntl<PublicProps>(DisconnectedTopic);
