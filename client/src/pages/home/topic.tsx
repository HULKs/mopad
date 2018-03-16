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
import DeleteIcon from "material-ui/svg-icons/action/delete-forever";
import EditIcon from "material-ui/svg-icons/editor/mode-edit";
import { TopicViewModel, TopicUpdate } from "../../business/topics";
import { ParticipationType, ParticipationChange } from "../../business/types";
import TopicEditDialog from "./topicEditDialog";
import TopicDeleteDialog from "./topicDeleteDialog";

interface PublicProps {
    topic: TopicViewModel;
    onChangeParticipation?(
        topicId: string,
        as: ParticipationType,
        action: ParticipationChange
    );
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

export class DisconnectedTopic extends React.Component<
    PublicProps & IntlProps,
    TopicState
> {
    constructor(props) {
        super(props);
        this.state = {
            editDialogOpen: false,
            deleteDialogOpen: false
        };
    }
    public render() {
        const {
            onChangeParticipation,
            intl,
            topic,
            onUpdate,
            onDelete
        } = this.props;
        const { editDialogOpen, deleteDialogOpen } = this.state;

        return (
            <Card className="topic card">
                <TopicActionIcons
                    show={topic.canManage}
                    onScheduleClick={() =>
                        this.setState({ editDialogOpen: true })
                    }
                    onDeleteClick={() =>
                        this.setState({ deleteDialogOpen: true })
                    }
                />
                <CardTitle
                    title={topic.title}
                    subtitle={topic.description || ""}
                    style={{ pointerEvents: "none" }}
                />
                <CardText>
                    {topic.location
                        ? <div>
                              <span style={topicLabelStyle}>
                                  <FormattedMessage id="topic.label.location" />:{" "}
                              </span>
                              {topic.location.name}
                          </div>
                        : []}
                    {topic.begin
                        ? <div>
                              <span style={topicLabelStyle}>
                                  <FormattedMessage id="topic.label.begin" />:{" "}
                              </span>
                              {Moment(topic.begin).format("dddd h:mma")}
                          </div>
                        : []}
                    {(topic.location || topic.begin) && !topic.isTalk
                        ? <div style={{ marginTop: 8 }} />
                        : []}
                    {topic.isTalk
                        ? []
                        : <>
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
                          </>}
                </CardText>
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
                <EditIcon />
            </IconButton>
            <IconButton
                style={iconOuterStyle}
                iconStyle={iconInnerStyle}
                onClick={onDeleteClick}
            >
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

    if (topic.isTalk) {
        return (
            <FlatButton
                onClick={() =>
                    onChangeParticipation(topic.id, "newbie", "join")
                }
                label={intl.formatMessage({ id: "topic.join.talk" })}
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
