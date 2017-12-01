import * as React from "react";
import { FormattedMessage, injectIntl, InjectedIntl } from "react-intl";
import * as Moment from "moment";
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
import { TopicViewModel } from "../../business/topics";
import { ParticipationType, ParticipationChange } from "../../business/types";
import TopicScheduleDialog from "./topicScheduleDialog";

interface PublicProps {
    topic: TopicViewModel;
    onChangeParticipation?(
        topicId: string,
        as: ParticipationType,
        action: ParticipationChange
    );
    onSchedule?(topicId: string, locationId: string, begin: Date);
    onDelete?(topicId: string);
}

interface IntlProps {
    intl: InjectedIntl;
}

interface TopicState {
    scheduleDialogOpen: boolean;
}

export class DisconnectedTopic extends React.Component<
    PublicProps & IntlProps,
    TopicState
> {
    constructor(props) {
        super(props);
        this.state = {
            scheduleDialogOpen: false
        };
    }
    public render() {
        const {
            onChangeParticipation,
            intl,
            topic,
            onSchedule,
            onDelete
        } = this.props;
        const { scheduleDialogOpen } = this.state;

        return (
            <Card className="topic card">
                <TopicActionIcons
                    show={topic.canManage}
                    onScheduleClick={() =>
                        this.setState({ scheduleDialogOpen: true })
                    }
                    onDeleteClick={() => onDelete(topic.id)}
                />
                <CardTitle
                    title={topic.title}
                    subtitle={this.getDescriptionText(topic)}
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
                <TopicScheduleDialog
                    open={scheduleDialogOpen}
                    onSubmit={(locId, begin) => {
                        onSchedule(topic.id, locId, begin);
                        this.setState({ scheduleDialogOpen: false });
                    }}
                    onCancel={() =>
                        this.setState({ scheduleDialogOpen: false })
                    }
                />
            </Card>
        );
    }

    private getDescriptionText(topic: TopicViewModel): string {
        const desc: string[] = [];
        if (topic.description) {
            desc.push(topic.description);
        }
        if (topic.begin) {
            desc.push(Moment(topic.begin).format("dddd h:mma"));
        }
        if (topic.location && topic.location.name) {
            desc.push(topic.location.name);
        }
        return desc.join(", ");
    }
}

function TopicActionIcons({
    show,
    onScheduleClick,
    onDeleteClick
}: {
    show: boolean;
    onScheduleClick?: Function;
    onDeleteClick?: Function;
}) {
    if (!show) return <div />;

    const divStyle: React.CSSProperties = {
        float: "right",
        padding: 16
    };
    const iconOuterStyle = { padding: 0, width: 36, height: 36 };
    const iconInnerStyle = { width: 24, height: 24 };
    return (
        <div style={divStyle}>
            <IconButton
                style={iconOuterStyle}
                iconStyle={iconInnerStyle}
                onClick={onScheduleClick}
            >
                <ActionQueryBuilderIcon />
            </IconButton>
            <IconButton
                style={iconOuterStyle}
                iconStyle={iconInnerStyle}
                onClick={onDeleteClick}
            >
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
