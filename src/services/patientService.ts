import { db } from '../firebaseConfig';
import { collection, getDocs, getDoc, addDoc, doc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Patient } from '../types';

const patientsCollectionRef = collection(db, 'patients');

export const getPatients = async (): Promise<Patient[]> => {
    const q = query(patientsCollectionRef, orderBy('name', 'asc'));
    const data = await getDocs(q);
    return data.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Patient[];
};

export const addPatient = async (patientData: Omit<Patient, 'id'>) => {
    return await addDoc(patientsCollectionRef, patientData);
};

export const updatePatient = async (id: string, patientData: Partial<Patient>) => {
    const patientDoc = doc(db, 'patients', id);
    return await updateDoc(patientDoc, patientData);
};

export const deletePatient = async (id: string) => {
    const patientDoc = doc(db, 'patients', id);
    return await deleteDoc(patientDoc);
};

// Increment usedSessions when session is completed
export const incrementUsedSessions = async (patientId: string): Promise<void> => {
    const patientRef = doc(db, 'patients', patientId);
    const patientSnap = await getDoc(patientRef);
    if (patientSnap.exists()) {
        const currentUsed = patientSnap.data().usedSessions || 0;
        await updateDoc(patientRef, { usedSessions: currentUsed + 1 });
    }
};

// Decrement usedSessions when session is uncompleted (e.g. status changed back)
export const decrementUsedSessions = async (patientId: string): Promise<void> => {
    const patientRef = doc(db, 'patients', patientId);
    const patientSnap = await getDoc(patientRef);
    if (patientSnap.exists()) {
        const currentUsed = patientSnap.data().usedSessions || 0;
        if (currentUsed > 0) {
            await updateDoc(patientRef, { usedSessions: currentUsed - 1 });
        }
    }
};
