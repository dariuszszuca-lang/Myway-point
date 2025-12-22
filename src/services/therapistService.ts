import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Therapist } from '../types';

const therapistsCollectionRef = collection(db, 'therapists');

export const getTherapists = async (): Promise<Therapist[]> => {
    const q = query(therapistsCollectionRef, orderBy('name', 'asc'));
    const data = await getDocs(q);
    return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Therapist[];
};

export const addTherapist = async (therapistData: Omit<Therapist, 'id'>) => {
    return await addDoc(therapistsCollectionRef, therapistData);
};

export const updateTherapist = async (id: string, therapistData: Partial<Therapist>) => {
    const therapistDoc = doc(db, 'therapists', id);
    return await updateDoc(therapistDoc, therapistData);
};

export const deleteTherapist = async (id: string) => {
    const therapistDoc = doc(db, 'therapists', id);
    return await deleteDoc(therapistDoc);
};
