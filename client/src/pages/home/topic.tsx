import * as React from "react";
import { FormattedMessage, injectIntl, InjectedIntl } from "react-intl";
import * as Moment from "moment";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import DeleteIcon from "@material-ui/icons/DeleteForever";
import EditIcon from "@material-ui/icons/Edit";
import { TopicViewModel, TopicUpdate } from "../../business/topics";
import { ParticipationType, ParticipationChange } from "../../business/types";
import TopicEditDialog from "./topicEditDialog";
import TopicDeleteDialog from "./topicDeleteDialog";
import Typography from "@material-ui/core/Typography/Typography";

interface PublicProps {
    topic: TopicViewModel;
    onChangeParticipation?(topicId: string, as: ParticipationType, action: ParticipationChange);
    onUpdate?(update: TopicUpdate);
    onDelete?(topicId: string);
}

interface IntlProps {
    intl: InjectedIntl;
}

interface TopicState {
    editDialogOpen: boolean;
    deleteDialogOpen: boolean;
}

const topicLabelStyle: React.CSSProperties = {
    display: "inline-block",
    width: 90,
    fontWeight: "bold"
};

export class DisconnectedTopic extends React.Component<PublicProps & IntlProps, TopicState> {
    constructor(props) {
        super(props);
        this.state = {
            editDialogOpen: false,
            deleteDialogOpen: false
        };
    }
    public render() {
        const { onChangeParticipation, intl, topic, onUpdate, onDelete } = this.props;
        const { editDialogOpen, deleteDialogOpen } = this.state;

        return (
            <Card className="topic card">
                <CardContent>
                    <TopicActionIcons
                        show={topic.canManage}
                        onScheduleClick={() => this.setState({ editDialogOpen: true })}
                        onDeleteClick={() => this.setState({ deleteDialogOpen: true })}
                    />
                    <Typography component="h5" variant="h5">
                        {topic.title}
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                        {topic.description || ""}
                    </Typography>
                    {topic.location ? (
                        <div>
                            <span style={topicLabelStyle}>
                                <FormattedMessage id="topic.label.location" />:{" "}
                            </span>
                            {topic.location.name}
                        </div>
                    ) : (
                        []
                    )}
                    {topic.begin ? (
                        <div>
                            <span style={topicLabelStyle}>
                                <FormattedMessage id="topic.label.begin" />:{" "}
                            </span>
                            {Moment(topic.begin).format("dddd h:mma")}
                        </div>
                    ) : (
                        []
                    )}
                    {(topic.location || topic.begin) && !topic.isTalk ? (
                        <div style={{ marginTop: 8 }} />
                    ) : (
                        []
                    )}
                    {topic.isTalk ? (
                        []
                    ) : (
                        <>
                            <div>
                                <span style={topicLabelStyle}>
                                    <FormattedMessage id="topic.label.expert" />:{" "}
                                </span>
                                {topic.experts.map(u => u.name).join(", ")}
                            </div>
                            <div>
                                <span style={topicLabelStyle}>
                                    <FormattedMessage id="topic.label.newbie" />:{" "}
                                </span>
                                {topic.newbies.map(u => u.name).join(", ")}
                            </div>
                        </>
                    )}
                </CardContent>
                <CardActions>
                    <TopicActions
                        topic={topic}
                        onChangeParticipation={onChangeParticipation}
                        intl={intl}
                    />
                </CardActions>
                <TopicEditDialog
                    open={editDialogOpen}
                    topic={topic}
                    onSubmit={update => {
                        this.setState({ editDialogOpen: false });
                        onUpdate && onUpdate(update);
                    }}
                    onCancel={() => this.setState({ editDialogOpen: false })}
                />
                <TopicDeleteDialog
                    open={deleteDialogOpen}
                    topic={topic}
                    onConfirm={() => {
                        this.setState({ deleteDialogOpen: false });
                        onDelete && onDelete(topic.id);
                    }}
                    onCancel={() => this.setState({ deleteDialogOpen: false })}
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
    onScheduleClick?: (event: any) => void;
    onDeleteClick?: (event: any) => void;
}) {
    if (!show) return <div />;

    const divStyle: React.CSSProperties = {
        float: "right"
    };
    const iconOuterStyle = { padding: 0, width: 36, height: 36 };
    return (
        <div style={divStyle}>
            <IconButton style={iconOuterStyle} onClick={onScheduleClick}>
                <EditIcon />
            </IconButton>
            <IconButton style={iconOuterStyle} onClick={onDeleteClick}>
                <DeleteIcon />
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
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "expert", "leave")}
            >
                {intl.formatMessage({ id: "topic.leave.expert" })}
            </Button>
        );
    }

    if (topic.userIsNewbie) {
        return (
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "newbie", "leave")}
            >
                {intl.formatMessage({ id: "topic.leave.newbie" })}
            </Button>
        );
    }

    if (topic.isTalk) {
        return (
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "newbie", "join")}
            >
                {intl.formatMessage({ id: "topic.join.talk" })}
            </Button>
        );
    }

    return (
        <div>
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "expert", "join")}
            >
                {intl.formatMessage({ id: "topic.join.expert" })}
            </Button>
            <Button
                color="primary"
                onClick={() => onChangeParticipation(topic.id, "newbie", "join")}
            >
                {intl.formatMessage({ id: "topic.join.newbie" })}
            </Button>
        </div>
    );
}

export default injectIntl<PublicProps>(DisconnectedTopic);
