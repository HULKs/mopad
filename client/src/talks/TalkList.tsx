import * as React from "react";
import gql from 'graphql-tag';
import graphql from 'react-apollo/graphql';
import {AllTalksQueryQuery} from '../../mopad-graphql';
import {QueryProps} from 'react-apollo';

interface PublicProps {}

interface DataProps {
    data: AllTalksQueryQuery & QueryProps;
}

type Props = PublicProps & DataProps;

class TalkList extends React.PureComponent<Props> {
    render() {
        if (this.props.data.loading) {
            return "loading...";
        }

        if (this.props.data.error) {
            return (
                <pre>
                    Errör
                </pre>
            );
        }

        console.info(this.props.data.allTalks);
        return (
            <ul>
                {this.props.data.allTalks.map(talk => <li key={talk.id}>{talk.title}</li>)}
            </ul>
        )
    }
}

const ALL_TALKS_QUERY = gql`
    query AllTalksQuery {
        allTalks {
            id,
            title
        }
    }
`;

export default graphql<AllTalksQueryQuery, PublicProps>(ALL_TALKS_QUERY)(TalkList);
