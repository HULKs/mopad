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
import IconButton from "material-ui/IconButton";
import ActionDeleteForeverIcon from "material-ui/svg-icons/action/delete-forever";
import ActionQueryBuilderIcon from "material-ui/svg-icons/action/query-builder";
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
                <TopicActionIcons show={topic.canManage} />
                <CardTitle
                    title={topic.title}
                    subtitle={topic.description}
                    style={{ pointerEvents: "none" }}
                />
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

function TopicActionIcons({ show }: { show: boolean }) {
    if (!show) return <div />;

    const divStyle: React.CSSProperties = {
        float: "right",
        padding: 16
    };
    const iconOuterStyle = { padding: 0, width: 36, height: 36 };
    const iconInnerStyle = { width: 24, height: 24 };
    return (
        <div style={divStyle}>
            <IconButton style={iconOuterStyle} iconStyle={iconInnerStyle}>
                <ActionQueryBuilderIcon />
            </IconButton>
            <IconButton style={iconOuterStyle} iconStyle={iconInnerStyle}>
                <ActionDeleteForeverIcon />
            </IconButton>
        </div>
    );
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
