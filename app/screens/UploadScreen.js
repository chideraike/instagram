import React from 'react';
import { TextInput, ActivityIndicator, StyleSheet, Text, View, Image, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { f, auth, database, storage } from '../../config/firebaseConfig';
import * as Permissions from 'expo-permissions';
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Icon } from 'react-native-eva-icons';

import UserAuth from '../components/auth';

class Upload extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loggedin: false,
            imageId: this.uniqueId(),
            imageSelected: false,
            uploading: false,
            caption: '',
            progress: 0
        }
    }

    _checkPermissions = async () => {
        const { status } = await Permissions.askAsync(Permissions.CAMERA);
        this.setState({ camera: status });

        const { statusRoll } = await Permissions.askAsync(Permissions.CAMERA_ROLL);
        this.setState({ cameraRoll: statusRoll });
    }

    s4 = () => {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    uniqueId = () => {
        return this.s4() + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4() + '-' + this.s4();
    }

    findNewImage = async () => {
        this._checkPermissions();

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'Images',
            allowsEditing: true,
            quality: 1
        });

        console.log(result);

        if (!result.cancelled) {
            console.log('upload image');
            this.setState({
                imageSelected: true,
                imageId: this.uniqueId(),
                uri: result.uri
            });
            // this.uploadImage(result.uri);
        } else {
            console.log('cancel');
            this.setState({
                imageSelected: false
            });
        }
    }

    uploadPublish = () => {
        if (this.state.uploading == false) {
            if (this.state.caption != '') {
                this.uploadImage(this.state.uri);
            } else {
                alert('Please enter a caption');
            }
        } else {
            console.log('Ignore button tap as already uploading');
        }
    }

    uploadImage = async (uri) => {
        var that = this;
        var userId = f.auth().currentUser.uid;
        var imageId = this.state.imageId;

        var re = /(?:\.([^.]+))?$/;
        var ext = re.exec(uri)[1];
        this.setState({
            currentFileType: ext,
            uploading: true
        });

        const response = await fetch(uri);
        const blob = await response.blob();
        var FilePath = imageId + '.' + that.state.currentFileType;

        var uploadTask = storage.ref('user/' + userId + '/img').child(FilePath).put(blob);

        uploadTask.on('state_changed', function (snapshot) {
            var progress = ((snapshot.bytesTransferred / snapshot.totalBytes) * 100).toFixed(0);
            console.log('Upload is ' + progress + '% complete');
            that.setState({
                progress: progress
            });
        }, function (error) {
            console.log('Error with upload - ' + error);
        }, function () {
            // complete
            that.setState({ progress: 100 });
            uploadTask.snapshot.ref.getDownloadURL().then(function (downloadURL) {
                console.log(downloadURL);
                that.processUpload(downloadURL);
            });
        });
    }

    processUpload = (imageUrl) => {
        // Process here ...

        // Set needed info
        var imageId = this.state.imageId;
        var userId = f.auth().currentUser.uid;
        var caption = this.state.caption;
        var dateTime = Date.now();
        var timestamp = Math.floor(dateTime / 1000);
        // Build photo object
        // author, caption, posted, url

        var photoObj = {
            author: userId,
            caption: caption,
            posted: timestamp,
            url: imageUrl
        }

        // Update database

        // Add to main feed
        database.ref('/photos/' + imageId).set(photoObj);

        // Set user photos object
        database.ref('/users/' + userId + '/photos/' + imageId).set(photoObj);

        alert('Image Uploaded!!');

        this.setState({
            uploading: false,
            imageSelected: false,
            caption: '',
            uri: ''
        });
    }

    cancelUpload = () => {
        this.setState({
            imageSelected: false
        });
    }

    componentDidMount = () => {
        var that = this;
        f.auth().onAuthStateChanged(function (user) {
            if (user) {
                //Logged In
                that.setState({
                    loggedin: true
                });
            } else {
                //Not logged In
                that.setState({
                    loggedin: false
                });
            }
        });
    }

    render() {
        return (
            <View style={styles.container}>
                {this.state.loggedin == true ? (
                    //Is logged in
                    <View style={{ flex: 1 }}>
                        {this.state.imageSelected == true ? (
                            <View style={{ flex: 1 }}>
                                <View style={styles.title}>
                                    <TouchableOpacity onPress={this.cancelUpload}>
                                        <Icon name='close-outline' height={30} width={30} fill="#000000" />
                                    </TouchableOpacity>
                                    <View>
                                        <Text style={styles.titleText}>New Upload</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => this.uploadPublish()}>
                                        <Icon name='cloud-upload-outline' height={30} width={30} fill="#000000" />
                                    </TouchableOpacity>
                                </View>
                                <KeyboardAwareScrollView style={{ padding: 5, flex: 1 }}>
                                    <View style={styles.uploadingImageContainer}>
                                        <Image source={{ uri: this.state.uri }} style={styles.uploadingImage} />
                                    </View>
                                    <Text style={{ marginTop: 10 }}>Your description:</Text>
                                    <TextInput
                                        editable={true}
                                        placeholder={'Enter your caption here ...'}
                                        maxLength={150}
                                        multiline={true}
                                        numberOfLines={4}
                                        onChangeText={(text) => this.setState({ caption: text })}
                                        style={styles.captionInput}
                                    />
                                    <TouchableOpacity onPress={() => this.uploadPublish()} style={styles.uploadButton}>
                                        <Text style={{ textAlign: 'center', color: 'white' }}>Upload & Publish</Text>
                                    </TouchableOpacity>
                                    {this.state.uploading == true ? (
                                        <View style={{ marginTop: 10, flexDirection: 'row', alignSelf: 'center' }}>
                                            <Text>{this.state.progress}%  </Text>
                                            {this.state.progress != 100 ? (
                                                <ActivityIndicator size='small' color='blue' />
                                            ) : (
                                                    <Text>Processing</Text>
                                                )}
                                        </View>
                                    ) : (
                                            <View></View>
                                        )}
                                </KeyboardAwareScrollView>
                            </View>
                        ) : (
                                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 28, paddingBottom: 15 }}>Upload New Post</Text>
                                    <TouchableOpacity onPress={() => this.findNewImage()} style={styles.selectPhoto}>
                                        <Text style={{ color: 'white' }}>Select Photo</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                    </View>
                ) : (
                        //Not logged in
                        <UserAuth message={'Please login to upload a photo'} />
                    )}
            </View>
        );
    }
}

function UploadScreen(props) {
    const navigation = useNavigation();
    const route = useRoute();
    return (
        <Upload {...props} navigation={navigation} route={route} />
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1
    },
    title: {
        height: 70,
        paddingTop: 30,
        backgroundColor: '#fafafa',
        borderBottomColor: '#000000',
        borderBottomWidth: 0.5,
        justifyContent: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10
    },
    titleText: {
        fontWeight: 'bold',
        fontSize: 20
    },
    uploadingImage: {
        resizeMode: 'contain',
        width: '100%',
        height: '100%'
    },
    uploadingImageContainer: {
        shadowColor: '#000000',
        shadowRadius: 3,
        shadowOpacity: 1,
        shadowOffset: {
            height: 0,
            width: 0
        },
        elevation: 10,
        justifyContent: 'center',
        alignItems: 'center',
        height: 365
    },
    captionInput: {
        marginVertical: 10,
        height: 'auto',
        padding: 5,
        borderColor: 'grey',
        borderWidth: 1,
        borderRadius: 3,
        backgroundColor: 'white',
        color: 'black',
        textAlignVertical: 'top'
    },
    uploadButton: {
        alignSelf: 'center',
        width: 170,
        marginHorizontal: 'auto',
        backgroundColor: 'purple',
        borderRadius: 5,
        paddingVertical: 10,
        paddingHorizontal: 20
    },
    selectPhoto: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: 'blue',
        borderRadius: 5
    }
});

export default UploadScreen;